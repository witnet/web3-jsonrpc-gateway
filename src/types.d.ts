declare module 'eth-json-rpc-infura' {
  import { JsonRpcMiddleware } from 'json-rpc-engine'

  interface CreateInfuraMiddlewareArg {
    network: string
    projectId: string
  }
  function createInfuraMiddleware<T, U> (
    arg: CreateInfuraMiddlewareArg
  ): JsonRpcMiddleware<T, U>

  export = createInfuraMiddleware
}
