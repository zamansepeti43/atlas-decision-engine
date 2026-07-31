import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAtlasPrompt } from './atlas-prompt.js';
import { buildConversationHistoryFromMessages } from '../../../atlas-ai/src/lib/conversation-engine.js';

test('buildAtlasPrompt includes Atlas voice and history context', () => {
  const messages = buildAtlasPrompt({
    message: 'Yapay zeka hakkında konuşalım',
    history: [
      { role: 'user', content: 'Merhaba' },
      { role: 'assistant', content: 'Merhaba! Size nasıl yardımcı olabilirim?' },
    ],
  });

  assert.equal(messages[0].role, 'system');
  assert.match(messages[0].content, /DURUM/);
  assert.match(messages[0].content, /Atlas/);
  assert.match(messages[0].content, /kullanıcıyla birlikte düşün/i);

  assert.equal(messages[1].role, 'user');
  assert.match(messages[1].content, /Kullanıcı: Merhaba/);
  assert.match(messages[1].content, /Kullanıcı: Yapay zeka hakkında konuşalım/);
});

test('buildConversationHistoryFromMessages preserves prior turns for memory', () => {
  const history = buildConversationHistoryFromMessages([
    { id: '1', role: 'user', type: 'text', content: 'Adım Ahmet.', timestamp: new Date() },
    {
      id: '2',
      role: 'atlas',
      type: 'rich',
      content: '',
      richContent: {
        intent: 'conversation',
        data: {
          message: 'Memnun oldum Ahmet.',
          tone: 'helpful',
          followUps: [],
        },
      },
      timestamp: new Date(),
    },
    { id: '3', role: 'user', type: 'text', content: 'Benim adım neydi?', timestamp: new Date() },
  ]);

  assert.deepEqual(history.map((entry) => entry.content), [
    'Adım Ahmet.',
    'Memnun oldum Ahmet.',
    'Benim adım neydi?',
  ]);
});

test('buildAtlasPrompt instructs Atlas to use a short question-driven structure', () => {
  const messages = buildAtlasPrompt({ message: 'İş değiştirmeyi düşünüyorum.' });
  const content = messages[0].content;

  assert.match(content, /kısa, yapılandırılmış/i);
  assert.match(content, /soru sorar/i);
  assert.match(content, /risk/i);
  assert.match(content, /DURUM/);
});
