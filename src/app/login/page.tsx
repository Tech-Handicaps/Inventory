import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[70vh] items-center justify-center text-sm text-black/55">
          Loading…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
