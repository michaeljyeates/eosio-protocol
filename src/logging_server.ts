
/*
Logging proxy server - Logs all messages flowing between two peers
 */


const {EOSIOStreamTokenizer} = require("./protocol/stream/tokenizer");
const {EOSIOStreamDeserializer}  = require("./protocol/stream/deserializer");
const {EOSIOStreamConsoleDebugger}  = require("./protocol/stream/debugger");

import * as net from 'net';


// the target nodeos server
const target = {
    host: 'jungle.eosdac.io',
    port: 9666
};
// the host and port that this server listens on
const source = {
    host: '127.0.0.1',
    port: 1337
};




class Peer {
    readonly socket: net.Socket;
    readonly target: net.Socket;

    constructor(client_socket: net.Socket){
        this.socket = client_socket;

        // connect to upstream server
        this.target = new net.Socket();
        this.target.on('error', (e) => {
            console.error(`TARGET SOCKET ERROR ${this.target.remoteAddress} - ${e.message}`);
            this.target.end();
        });
        client_socket.on('error', (e) => {
            console.error(`CLIENT SOCKET ERROR ${client_socket.remoteAddress} - ${e.message}`);
            client_socket.end();
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
}







const peers: Peer[] = [];
const server = net.createServer(function(socket: net.Socket) {
    console.log(`Connection received from ${socket.remoteAddress}`);

    const peer = new Peer(socket);
    peers.push(peer);

    console.log(`Total peers : ${peers.length}`);
});

server.listen(source.port, source.host);
