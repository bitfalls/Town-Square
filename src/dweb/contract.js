import bs58 from 'bs58'
import Web3 from 'web3'
import COMMENT_STATUS from '../enum/commentStatus'
import Emitter from '../util/emitter'

let web3, contract

//eslint-disable-next-line
const abi = [{"name": "Comment", "inputs": [{"type": "int128", "name": "index", "indexed": true}, {"type": "address", "name": "author", "indexed": true}, {"type": "int128", "name": "_parent", "indexed": true}], "anonymous": false, "type": "event"}, {"name": "__init__", "outputs": [], "inputs": [], "constant": false, "payable": false, "type": "constructor"}, {"name": "publishThread", "outputs": [], "inputs": [{"type": "bytes32", "name": "_ipfs_hash"}], "constant": false, "payable": false, "type": "function", "gas": 183171}, {"name": "publishComment", "outputs": [], "inputs": [{"type": "int128", "name": "_parent"}, {"type": "bytes32", "name": "_ipfs_hash"}], "constant": false, "payable": false, "type": "function", "gas": 234576}, {"name": "comments__child", "outputs": [{"type": "int128", "name": "out"}], "inputs": [{"type": "int128", "name": "arg0"}], "constant": true, "payable": false, "type": "function", "gas": 844}, {"name": "comments__sibling", "outputs": [{"type": "int128", "name": "out"}], "inputs": [{"type": "int128", "name": "arg0"}], "constant": true, "payable": false, "type": "function", "gas": 874}, {"name": "comments__author", "outputs": [{"type": "address", "name": "out"}], "inputs": [{"type": "int128", "name": "arg0"}], "constant": true, "payable": false, "type": "function", "gas": 898}, {"name": "comments__ipfs_hash", "outputs": [{"type": "bytes32", "name": "out"}], "inputs": [{"type": "int128", "name": "arg0"}], "constant": true, "payable": false, "type": "function", "gas": 934}, {"name": "comments__date_posted", "outputs": [{"type": "uint256", "name": "out"}], "inputs": [{"type": "int128", "name": "arg0"}], "constant": true, "payable": false, "type": "function", "gas": 964}, {"name": "comment_count", "outputs": [{"type": "int128", "name": "out"}], "inputs": [], "constant": true, "payable": false, "type": "function", "gas": 693}]
const contractAddress = process.env.contractAddress

function ipfsHashToBytes32 (ipfsHash) {
  return '0x' + bs58.decode(ipfsHash).slice(2).toString('hex')
}

export default {
  connectToWeb3: function (ethereumUrl) {
    if (typeof window.web3 !== 'undefined') {
      // connect via metamask
      web3 = new Web3(window.web3.currentProvider)
      web3.currentProvider.publicConfigStore.on('update', details => {
        Emitter.emit('Metamask-Update', details)
      })
    } else {
      // connect via remote node
      web3 = new Web3(new Web3.providers.HttpProvider(ethereumUrl))
    }

    return web3.eth.net.getNetworkType().then(type => {
      console.log('connected to ethereum ' + type + ' network')

      // fetch accounts and emit the results
      web3.eth.getAccounts().then(accounts => {
        Emitter.emit('Metamask-Update', { selectedAddress: accounts[0] })
      })

      if ((type === 'main' && process.env.NODE_ENV === 'production') ||
          (type === 'rinkeby' && process.env.NODE_ENV === 'development')) {
        contract = new web3.eth.Contract(abi, contractAddress)
      } else {
        throw new Error('Not connected to mainnet')
      }
    })
  },

  getComment: function (index) {
    return Promise.all([
      contract.methods.comments__child(index).call(),
      contract.methods.comments__sibling(index).call(),
      contract.methods.comments__author(index).call(),
      contract.methods.comments__ipfs_hash(index).call(),
      contract.methods.comments__date_posted(index).call()
    ]).then(results => {
      const comment = {
        child: Number(results[0]),
        sibling: Number(results[1]),
        author: results[2].toLowerCase(),
        ipfsHash: results[3],
        datePosted: results[4],
        status: COMMENT_STATUS.SAVED,
        id: index
      }

      return comment
    })
  },

  getCommentsByPerson: function (address) {
    return contract.getPastEvents('Comment', {
      filter: {author: address},
      fromBlock: 0,
      toBlock: 'latest'
    })
  },

  publishComment: function (parent, ipfsHash, account) {
    const ipfsBytes32 = ipfsHashToBytes32(ipfsHash)
    return contract.methods.publishComment(parent, ipfsBytes32).send({
      from: account
    })
  },

  publishThread: function (ipfsHash, account) {
    const ipfsBytes32 = ipfsHashToBytes32(ipfsHash)
    return contract.methods.publishThread(ipfsBytes32).send({
      from: account
    })
  }
}
