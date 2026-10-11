import SakhiAI from "./SakhiAI";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./components/Toast";
import { LanguageProvider } from "./i18n/LanguageContext";

function App() {
  return (
    <LanguageProvider>
      <ToastProvider>
        <AuthProvider>
          <SakhiAI />
        </AuthProvider>
      </ToastProvider>
    </LanguageProvider>
  );
}

export default App;
