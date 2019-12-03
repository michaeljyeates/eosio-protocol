
import * as stream from 'stream';
const {concatenate} = require('../../includes/utils');

/*
Tokenising stream

Receives fragmented data from the tcp socket and stores it until a complete message is in the buffer and then pushes
the complete message
 */

export class EOSIOStreamTokenizer extends stream.Transform {
    private array: Uint8Array;
    private buffer: any[];

    constructor(options){
        // options.objectMode = true;
        super(options);

        this.array = new Uint8Array();
        this.buffer = [];
    }

    _transform(data, encoding, callback){
        // console.log(data);
        if (encoding !== 'buffer'){
            console.log('Received UTF8');
            // throw new Error(`Incorrect buffer encoding ${encoding}`);
        }

        this.array = concatenate(this.array, data);

        // console.log(`Stream write`, this.array.length);

        let msg_data;
        while (msg_data = this.process()){
            this.buffer.push(msg_data);
        }

        let item;
        while (item = this.buffer.shift()){
            // console.log('item in read buffer', item);
            this.push(item);
        }

        callback();


    }

    _flush(callback){
        callback();
    }

    process(){
        // read length of the first message
        let current_length = 0;
        for (let i=0;i<4;i++){
            current_length |= this.array[i] << (i * 8);
        }
        current_length += 4;

        let msg_data = null;

        // console.log(`Processing with length ${current_length}`);

        if (current_length <= this.array.length){
            // console.log(`Read queue ${current_length} from buffer ${this.array.length}`);

            // console.log(this.array.slice(0, current_length));
            msg_data = this.array.slice(0, current_length);

            this.array = this.array.slice(current_length);
            // console.log(`Length now ${this.array.length}`);
        }

        return msg_data;
    }

}


