
const {EOSIOP2PClient} = require('./client');
// const HOST = '127.0.0.1';
// const PORT = 9877;
// const API = 'http://127.0.0.1:8888';
// const HOST = 'jungle2.eosdac.io';
// const PORT = 9862;
// const API = 'https://jungle.eosdac.io';
const HOST = '145.239.150.200';
const PORT = 9876;
const API = 'https://eu.eosdac.io';
// const HOST = 'p2p.eossweden.org';
// const PORT = 9876;
// const API = 'https://api.eossweden.org';


const p2p = new EOSIOP2PClient({host: HOST, port: PORT, api: API});
p2p.connect().then(() => {
    // if you do not send the handshake then the server will respond with time_message anyway
    p2p.send_handshake();
});
