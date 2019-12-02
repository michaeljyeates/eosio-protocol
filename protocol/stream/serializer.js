
const stream = require('stream');
const {Serialize} = require('eosjs');
const {abi, types} = require('../net-protocol');

class EOSIOStreamSerializer extends stream.Transform {
    constructor(options){
        super({writableObjectMode:true, readableObjectMode:true});
    }

    _transform(data, encoding, callback){
        try {
            // console.log(`transform`, data);
            const msg = this.serialize_message(data);

            if (msg){
                this.push(msg);
            }

            callback();
        }
        catch (e){
            this.destroy(`Failed to serialize`);
            console.error(e);
            callback(`Failed to serialize`);
        }
    }

    serialize_message([type, type_name, data]){

        const sb = new Serialize.SerialBuffer({
            textEncoder: new TextEncoder,
            textDecoder: new TextDecoder
        });

        // put the message into a serialbuffer
        const msg_types = abi.variants[0].types;
        types.get(msg_types[type]).serialize(sb, data);

        const len = sb.length;
        // console.log(`${msg_types[type]} buffer is ${len} long`);

        // Append length and msg type
        const header = new Serialize.SerialBuffer({
            textEncoder: new TextEncoder,
            textDecoder: new TextDecoder
        });
        header.pushUint32(len + 1);
        header.push(type); // message type

        const buf = Buffer.concat([Buffer.from(header.asUint8Array()), Buffer.from(sb.asUint8Array())]);

        return buf;
    }
}

module.exports = EOSIOStreamSerializer;