# Code Map
*Living doc. Update on structural changes.*

## Architecture
- App: React Native (Expo) + TypeScript
- Backend: Firebase (Cloud Firestore)

## Files
- `src/navigation/AppNavigator.tsx`: Configuración de pestañas (Tabs).
- `src/screens/*`: Pantallas principales (Calendario, Citas, Servicios).
- `App.tsx`: Main entry point (carga el AppNavigator).
- `package.json`, `app.json`: Expo and dependencies config.
- `tsconfig.json`, `babel.config.js`: Compiler configs.
- `agents.md`: Core agent rules.
- `code_map.md`: This architecture file.
