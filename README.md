# EOSIO Protocol with Javascript

This repository contains a set of classes and ABI declarations which can be used to create a client which conforms to 
the EOSIO net protocol.

### Streams

The majority of the functionality is provided by several stream handlers.  This provides a very efficient way to pipe
data between these components.

#### EOSIOStreamTokenizer

```import { EOSIOStreamConsoleDebugger } from 'eosio-protocol/stream/debugger';```

Receives fragmented data from the tcp socket and stores it until a complete message is in the buffer and then pushes
the complete message

#### EOSIOStreamDeserializer

```import { EOSIOStreamDeserializer } from 'eosio-protocol/stream/deserializer';```

Transform stream which reads tokenised binary messages from the EOSIOStreamTokenizer

#### EOSIOStreamSerializer

```import { EOSIOStreamSerializer } from 'eosio-protocol/stream/serializer';```

Receives objects representing net messages and serializes them into a binary format understandable by the EOSIO P2P
protocol.  The output from this stream can be piped directly to the tcp socket.

#### EOSIOStreamConsoleDebugger

```import { EOSIOStreamConsoleDebugger } from 'eosio-protocol/stream/debugger';```

Writable stream which takes the object output from EOSIOStreamDeserializer and logs it to the console in a compact 
format.

### Helpers

#### EOSIOP2PClientConnection

Utility class for maintaining a single client connection, provides functionality for holding a connection and sending
data to the TCP stream.

## Examples

The files `test.ts` and `logging_server.ts` show examples of a benchmarking script and a simple proxy which will log all
net messages passing through it.

## Possible applications

- P2P Proxies, including traffic shaping of EOSIO connections to optimise nodes for syncing peers.
- Benchmarking
- Testing
- Extending the net protocol for use by non-nodeos applications