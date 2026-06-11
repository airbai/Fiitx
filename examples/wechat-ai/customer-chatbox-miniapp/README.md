# Customer Mini Program Chatbox Demo

This mini program is a channel test client for Deepsix and follows the WeChat AI demo layout:

- `app.json`
- `pages/index/index.*`
- `skills/drink-skill/*`
- `page-meta.json`

Flow:

1. A user enters a message in the mini program chatbox, for example `第一杯美式咖啡`.
2. The page sends `POST http://127.0.0.1:18766/channels/wechat/messages`.
3. Deepsix Gateway routes the text to `skills/drink-skill`.
4. The response contains a WeChat card payload, such as `components/order-confirm-card/index`.
5. The mini program renders the text reply and a JSON preview of the card.

In WeChat DevTools, open this `customer-chatbox-miniapp` folder directly and enable local development settings that skip domain verification. For a production deployment, replace `gatewayEndpoint` in `app.js` with the deployed Deepsix Gateway HTTPS endpoint.
