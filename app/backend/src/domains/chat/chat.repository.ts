import postgres from 'postgres';
export interface ChatRepository {}
export function createChatRepository(db: postgres.Sql): ChatRepository {
  return {};
}
