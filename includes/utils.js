const concatenate = (...arrays) => {
    let totalLength = 0;
    for (let arr of arrays) {
        totalLength += arr.length;
    }
    let result = new Uint8Array(totalLength);
    let offset = 0;
    for (let arr of arrays) {
        result.set(arr, offset);
        offset += arr.length;
    }
    return result;
};


async function sleep(ms){
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

module.exports = {concatenate, sleep};