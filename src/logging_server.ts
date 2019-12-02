
/*
Logging server - Connects to a source and a destination and will log all messages
 */


const {EOSIOStreamTokenizer} = require("./protocol/stream/tokenizer");
const {EOSIOStreamDeserializer}  = require("./protocol/stream/deserializer");
const {EOSIOStreamConsoleDebugger}  = require("./protocol/stream/debugger");

const net = require('net');

const source = {
    host: '127.0.0.1',
    port: 1337
};

const dest = {
    host: 'jungle.eosdac.io',
    port: 9666
};


const client = new net.Socket();
// Log outgoing messages
client
    .pipe(new EOSIOStreamTokenizer({}))
    .pipe(new EOSIOStreamDeserializer({}))
    .pipe(new EOSIOStreamConsoleDebugger({prefix: '<<<'}));

client.connect(dest.port, dest.host, function() {
    console.log('Connected to p2p destination');
});


let connected_socket = null;
const server = net.createServer(function(socket) {
    if (connected_socket){
        throw new Error('Only one connected client allowed');
    }
    connected_socket = socket;
    // send all data to the real server
    socket.pipe(client);
    // log any incoming messages
    socket
        .pipe(new EOSIOStreamTokenizer({}))
        .pipe(new EOSIOStreamDeserializer({}))
        .pipe(new EOSIOStreamConsoleDebugger({prefix: '>>>'}));

    client.pipe(connected_socket);
});

server.listen(1337, '127.0.0.1');
