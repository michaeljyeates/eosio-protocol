
/*
Logging proxy server - Logs all messages flowing between two peers
 */


import {EventEmitter} from "events";

const {EOSIOStreamTokenizer} = require("./protocol/stream/tokenizer");
const {EOSIOStreamDeserializer}  = require("./protocol/stream/deserializer");
const {EOSIOStreamConsoleDebugger}  = require("./protocol/stream/debugger");

import * as net from 'net';
const {target, source} = require('../logging_server.config');



class Peer extends EventEmitter {
    readonly socket: net.Socket;
    public target: net.Socket;

    constructor(client_socket: net.Socket){
        super();

        this.socket = client_socket;

        this.connect_target().then(() => {
            client_socket.on('error', (e) => {
                console.error(`CLIENT SOCKET ERROR ${client_socket.remoteAddress} - ${e.message}`);
                client_socket.destroy();
                this.emit('client_error', e);
            });
            client_socket.on('end', () => {
                console.error(`CLIENT SOCKET END ${client_socket.remoteAddress}`);
                client_socket.destroy();
                this.emit('client_end');
            });
            // send all data to the target server
            client_socket.pipe(this.target);

            // Log received messages
            client_socket
                .pipe(new EOSIOStreamTokenizer({}))
                .pipe(new EOSIOStreamDeserializer({}))
                .pipe(new EOSIOStreamConsoleDebugger({prefix: `<<< ${client_socket.remoteAddress}:${client_socket.remotePort}`}));

            // Send all data from our target to the connected client
            this.target.pipe(client_socket);
            //
            // // log outgoing messages
            this.target
                .pipe(new EOSIOStreamTokenizer({}))
                .pipe(new EOSIOStreamDeserializer({}))
                .pipe(new EOSIOStreamConsoleDebugger({prefix: `>>> ${client_socket.remoteAddress}:${client_socket.remotePort}`}));
        });

    }

    async connect_target(){

        // connect to upstream server
        this.target = new net.Socket();
        this.target.on('error', (e) => {
            console.error(`TARGET SOCKET ERROR ${this.target.remoteAddress} - ${e.message}`);
            this.target.end();
            this.emit('target_error', e);
            // TODO : try to reconnect
        });
        this.target.on('end', () => {
            console.error(`TARGET SOCKET END ${this.target.remoteAddress}`);
            this.target.end();
            this.emit('target_end');
            // TODO : try to reconnect
        });

        this.target.connect(target.port, target.host, () => {
            console.log('Connected to nodeos target');
            this.emit('target_connected', target);
        });
    }

    destroy(){
        this.target.end();
        this.socket.end();
    }

}







const peers: Set<Peer> = new Set<Peer>();
const server = net.createServer(function(socket: net.Socket) {
    console.log(`Connection received from ${socket.remoteAddress}`);

    const peer = new Peer(socket);
    peer.on('client_error', function (e) {
        console.log("Peer client_error");
        peers.delete(peer);
    });
    peer.on('client_end', function (e) {
        console.log("Peer client_end");
        if (peers.has(peer)){
            peers.delete(peer);
        }
        console.log(`Total peers : ${peers.size}`);
    });
    peers.add(peer);


    console.log(`Total peers : ${peers.size}`);
});

server.listen(source.port, source.host);
