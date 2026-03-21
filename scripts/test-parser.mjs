import { parsePerformancePrefix, createStreamPrefixBuffer } from '../src/core/performance-parser.js';

// Test 1: Full parse
const r1 = parsePerformancePrefix('{"emotion":"concerned","camera":"close","action":"lean-in"}\n---\n你怎么了？摔严重了吗？');
console.log('Test1 parse:', JSON.stringify(r1));
console.assert(r1.intent?.emotion === 'concerned', 'T1: emotion should be concerned');
console.assert(r1.text === '你怎么了？摔严重了吗？', 'T1: text should be clean');

// Test 2: No prefix (fallback)
const r2 = parsePerformancePrefix('今天天气不错啊');
console.log('Test2 no-prefix:', JSON.stringify(r2));
console.assert(r2.intent === null, 'T2: intent should be null');
console.assert(r2.text === '今天天气不错啊', 'T2: text should be raw');

// Test 3: Stream buffer
const buf = createStreamPrefixBuffer();
const s1 = buf.push('{"emotion":"happy"');
console.log('Stream push1:', JSON.stringify(s1));
console.assert(!s1.resolved, 'S1: should not be resolved yet');

const s2 = buf.push(',"camera":"wide","action":"nod"}\n---\n哈哈');
console.log('Stream push2:', JSON.stringify(s2));
console.assert(s2.resolved, 'S2: should be resolved');
console.assert(s2.intent?.emotion === 'happy', 'S2: emotion should be happy');

const s3 = buf.push('真的吗');
console.log('Stream push3:', JSON.stringify(s3));
console.assert(s3.resolved, 'S3: should still be resolved');
console.assert(s3.textDelta === '真的吗', 'S3: textDelta should pass through');

console.log('Final intent:', JSON.stringify(buf.getIntent()));

// Test 4: Thinking tags in non-stream parse
const thinkInput = '<think>好，说个短的。有个人每天路过同一条街。不是什么好故事。</think> {"emotion":"calm","camera":"wide","action":"soft-smile"}\n---\n行，说个短的。有个人每天路过同一条街。';
const r4 = parsePerformancePrefix(thinkInput);
console.log('Test4 thinking:', JSON.stringify(r4));
console.assert(r4.intent?.emotion === 'calm', 'T4: emotion should be calm');
console.assert(!r4.text.includes('<think>'), 'T4: text should not contain <think>');
console.assert(!r4.text.includes('</think>'), 'T4: text should not contain </think>');
console.assert(r4.text.startsWith('行，说个短的'), 'T4: text should start with actual response');

// Test 5: Thinking tags in stream buffer
const buf2 = createStreamPrefixBuffer();
buf2.push('<think>');
buf2.push('这是思考内容，用户不应该看到');
buf2.push('</think> ');
const s5 = buf2.push('{"emotion":"sad","camera":"close","action":"lean-in"}\n---\n我听到了...');
console.log('Test5 stream-think:', JSON.stringify(s5));
console.assert(s5.resolved, 'S5: should be resolved');
console.assert(s5.intent?.emotion === 'sad', 'S5: emotion should be sad');
console.assert(!s5.textDelta.includes('<think>'), 'S5: textDelta should not contain thinking');

console.log('\nAll tests passed!');
