// Sends a push notification through Expo's push service. Failures never break the main flow.
async function sendPush(token, { title, body, data }) {
  if (!token || !/^Expo(nent)?PushToken\[/.test(token)) return false;
  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ to: token, title, body, data, sound: 'default', priority: 'high', channelId: 'dispatch' }),
    });
    return res.ok;
  } catch (err) {
    console.warn('Push failed:', err.message);
    return false;
  }
}
module.exports = { sendPush };
