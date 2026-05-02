// SheSafe — Auth Context
// Separate file to avoid circular dependency: App.js ↔ LoginScreen.js
import React from 'react';

export const AuthContext = React.createContext({ onLogin: () => {} });
