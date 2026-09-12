import { User, ChatRoom, Message } from './types';

export const CURRENT_USER_ID = 'user-001';

export const MOCK_USERS: Record<string, User> = {
  'user-001': { id: 'user-001', name: '自分（山田 太郎）', avatarUrl: '' },
  'user-002': { id: 'user-002', name: '佐藤 花子', avatarUrl: '' },
};

export const MOCK_ROOM: ChatRoom = {
  id: 'room-101',
  memberIds: ['user-001', 'user-002'],
};

export const INITIAL_MESSAGES: Message[] = [
  { id: 'm1', roomId: 'room-101', senderId: 'user-002', text: 'こんにちは！打ち合わせの件です。', timestamp: '14:20' },
  { id: 'm2', roomId: 'room-101', senderId: 'user-001', text: '15時からで大丈夫ですか？', timestamp: '14:22' },
  { id: 'm3', roomId: 'room-101', senderId: 'user-002', text: 'はい、よろしくお願いします！', timestamp: '14:25' },
];
