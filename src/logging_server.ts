
/*
Logging proxy server - Logs all messages flowing between two peers
 */


const {EOSIOStreamTokenizer} = require("./protocol/stream/tokenizer");
const {EOSIOStreamDeserializer}  = require("./protocol/stream/deserializer");
const {EOSIOStreamConsoleDebugger}  = require("./protocol/stream/debugger");

import * as net from 'net';
const {target, source} = require('../logging_server.config');



class Peer {
    readonly socket: net.Socket;
    readonly target: net.Socket;
    private index: number;

    constructor(client_socket: net.Socket){
        this.socket = client_socket;

        // connect to upstream server
        this.target = new net.Socket();
        this.target.on('error', (e) => {
            console.error(`TARGET SOCKET ERROR ${this.target.remoteAddress} - ${e.message}`);
            this.target.end();
            // TODO : try to reconnect
        });
        client_socket.on('error', (e) => {
            console.error(`CLIENT SOCKET ERROR ${client_socket.remoteAddress} - ${e.message}`);
            this.destroy();
        });
        // send all data to the target server
        client_socket.pipe(this.target);

        // Log received messages
        client_socket
            .pipe(new EOSIOStreamTokenizer({}))
            .pipe(new EOSIOStreamDeserializer({}))
            .pipe(new EOSIOStreamConsoleDebugger({prefix: `<<< ${client_socket.remoteAddress}:${client_socket.remotePort}`}));

        this.target.connect(target.port, target.host, () => {
            console.log('Connected to nodeos target');

            // Send all data from our target to
            this.target.pipe(client_socket);

            // log outgoing messages
            this.target
                .pipe(new EOSIOStreamTokenizer({}))
                .pipe(new EOSIOStreamDeserializer({}))
                .pipe(new EOSIOStreamConsoleDebugger({prefix: `>>> ${client_socket.remoteAddress}:${client_socket.remotePort}`}));
        });
    }

    destroy(){
        this.target.end();
        this.socket.end();
    }

    set_index(index: number){
        this.index = index;
    }
}







const peers: Peer[] = [];
let total_peers: number = 0;
const server = net.createServer(function(socket: net.Socket) {
    console.log(`Connection received from ${socket.remoteAddress}`);

    const peer = new Peer(socket);
    peer.set_index(peers.length);
    peers.push(peer);

    console.log(`Total peers : ${++total_peers}`);
});

server.listen(source.port, source.host);
