# Code Map
*Living doc. Update on structural changes.*

## Architecture
- App: React Native (Expo Web/Mobile) + TypeScript
- Backend: Firebase (Cloud Firestore)

## Files
- `src/navigation/AppNavigator.tsx`: Custom top tab bar & navigation stack.
- `src/screens/CalendarScreen.tsx`: Daily appointments, team conflicts, budget display, maps.
- `src/screens/RouteScreen.tsx`: Daily multi-stop itinerary & Google Maps route generator.
- `src/screens/AppointmentsScreen.tsx`: Booking, team selector, AI slot optimizer, budget.
- `src/screens/ServicesScreen.tsx`: CRUD services catalog (name, duration, base price).
- `src/config/firebase.ts`: Firebase configuration & db init.
- `App.tsx`: Main entry point.
