const Websocket = require('ws');
const Blockchain = require('../blockchain/blockchain');
const Miner = require('./miner');
const Block = require("../blockchain/block");

const HTTP_PORT = process.env.HTTP_PORT || 3001;
const P2P_PORT = process.env.P2P_PORT || 5001;
const peers = process.env.PEERS ? process.env.PEERS.split(',') : [];
const MESSAGE_TYPES = {
    add_new_chains: 'CHAINS',
    update_chain: 'UPDATE_CHAIN',
    transaction: 'TRANSACTION',
    clear_vote: 'CLEAR_VOTE',
    create_chains: 'CREATE_CHAINS',
    add_vote: 'ADD_VOTE',
    close_vote: 'CLOSE_VOTE',
    calculate_results: 'CALCULATE_RESULTS',
    final_results: 'FINAL_RESULTS'
};

class P2pServer {
    constructor(tp) {
        this.blockchain = [];
        this.transactionPool = tp;
        this.sockets = [];
        this.miner = new Miner(this.transactionPool, this);
        this.voteResults = [];
        this.validResults = false;
    }

    listen() {
        const server = new Websocket.Server({ port: P2P_PORT });
        server.on('connection', socket => this.connectSocket(socket));

        this.connectToPeers();

        console.log(`Listening for peer-to-peer connections on: ${P2P_PORT}`);
    }

    connectToPeers() {
        peers.forEach(peer => {
            // ws://localhost:5001
            const socket = new Websocket(peer);

            socket.on('open', () => this.connectSocket(socket));
        });
    }

    connectSocket(socket) {
        this.sockets.push(socket);
        console.log('Socket connected');

        this.messageHandler(socket);

        this.syncNewChains();
    }

    messageHandler(socket) {
        socket.on('message', message => {
            const data = JSON.parse(message);
            switch (data.type) {
                case MESSAGE_TYPES.add_new_chains:
                    if (this.blockchain === undefined)
                        this.blockchain = [];
                    let chain = new Blockchain("");
                    chain.chain = data.chains;
                    this.blockchain.push(chain);
                    break;
                case MESSAGE_TYPES.transaction:
                    this.transactionPool.addTransaction(data.vote);
                    break;
                case MESSAGE_TYPES.clear_vote:
                    this.transactionPool.clear(data.data);
                    break;
                case MESSAGE_TYPES.create_chains:
                    this.blockchain = [];
                    for (let key in data.data) {
                        this.blockchain.push(new Blockchain(data.data[key]));
                    }
                    this.blockchain.push(new Blockchain('VOT NUL'));
                    console.log(this.blockchain);
                    this.syncNewChains();
                    break;
                case MESSAGE_TYPES.update_chain:
                    this.blockchain.forEach(bc => {
                        if (bc.getGenesisData() === data.chain[0].data) {
                            bc.replaceChain(data.chain);
                        }
                    });
                    break;
                case MESSAGE_TYPES.calculate_results:
                    let results = [];
                    this.blockchain.forEach(bc => {
                        let candidate = bc.getGenesisData();
                        results.push({ candidate: candidate, votes: bc.chain.length - 1 });
                    });
                    this.sockets.forEach(socket => {
                        socket.send(JSON.stringify({
                            type: MESSAGE_TYPES.final_results,
                            data: results
                        }));
                    });
                    break;
                case MESSAGE_TYPES.final_results:
                    console.log("-------------- vote results");
                    console.log(this.voteResults);
                    console.log(data.data);
                    if (JSON.stringify(this.voteResults) === JSON.stringify(data.data)) {
                        this.validResults = true;
                        console.log(this.validResults);
                    }
            }
        });
    }

    sendNewChains(socket, bc) {
        socket.send(JSON.stringify({
            type: MESSAGE_TYPES.add_new_chains,
            chains: bc.chain
        }));
    }

    syncNewChains() {
        if (this.blockchain !== undefined) {
            this.blockchain.forEach(bc => {
                this.sockets.forEach(socket => this.sendNewChains(socket, bc));
            });
        }
    }

    sendChain(socket, bc) {
        socket.send(JSON.stringify({
            type: MESSAGE_TYPES.update_chain,
            chain: bc.chain
        }));
    }

    syncChains(chain) {
        this.sockets.forEach(socket => this.sendChain(socket, chain));
    }

    broadcastClearPool(voter_id) {
        this.sockets.forEach(socket => socket.send(JSON.stringify({
            type: MESSAGE_TYPES.clear_vote,
            data: voter_id
        })));
    }

    getBlockchains(genesis_data) {
        return this.blockchain.forEach(bc => {
            if (bc.getGenesisData() === genesis_data)
                console.log(bc);
        });
    }

    sendVote(socket, vote) {
        socket.send(JSON.stringify({
            type: MESSAGE_TYPES.transaction,
            vote
        }));
    }

    addVote(vote) {
        this.sockets.forEach(socket => this.sendVote(socket, vote));
    }

    confirmVote(voter_id, voter_option) {
        this.miner.mine(voter_id, voter_option, this.blockchain);
    }

    getCandidates() {
        let candidates = [];
        this.blockchain.forEach(bc => {
           candidates.push(bc.getGenesisData());
        });
        return candidates;
    }

    calculateResults() {

        let results = [];
        this.blockchain.forEach(bc => {
           let candidate = bc.getGenesisData();
           results.push({ candidate: candidate, votes: bc.chain.length - 1 });
        });
        this.voteResults = results;
        // TODO: Calculate results for vote

        this.sockets.forEach(socket => {
            socket.send(JSON.stringify({
                type: MESSAGE_TYPES.calculate_results
            }));
        });
    }

    getResults() {
        console.log(this.validResults);
        if (this.validResults) {
            console.log("here");
            return this.voteResults;
        }
    }
}

module.exports = P2pServer;