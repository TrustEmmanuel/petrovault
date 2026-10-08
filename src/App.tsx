import { useEffect } from "react";
import { Login } from "./components/Login";
import { Shell } from "./components/Shell";
import { useStore } from "./state/store";
import { PERSONAS } from "./types";

export function App() {
  const { session } = useStore();

  useEffect(() => {
    document.title = session ? `PetroVault · ${PERSONAS[session.role].title}` : "PetroVault · Sign in";
  }, [session]);

  return session ? <Shell /> : <Login />;
}
