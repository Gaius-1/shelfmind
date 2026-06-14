import handler from '@tanstack/react-start/server-entry'
export { JobCoordinator } from './workers/jobCoordinator'

export default {
  fetch: handler.fetch,
  async queue(batch: any, env: any, ctx: any) {
    console.log(`Received ${batch.messages.length} messages in queue`);
    // TODO: Implement image processing pipeline here
  }
}
