# 🏪 App Store

> Discover and install apps from zos-apps

Part of the [zOS Apps](https://github.com/zos-apps) ecosystem.

## Installation

```bash
npm install github:zos-apps/app-store
```

## Usage

```tsx
import App from '@zos-apps/app-store';

function MyApp() {
  return <App />;
}
```

## Package Spec

App metadata is defined in `package.json` under the `zos` field:

```json
{
  "zos": {
    "id": "ai.hanzo.appstore",
    "name": "App Store",
    "icon": "🏪",
    "category": "system",
    "permissions": ["network"],
    "installable": true
  }
}
```

## Version

v4.2.0

## License

MIT © Hanzo AI
