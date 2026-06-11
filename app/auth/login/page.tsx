import LoginForm from "./LoginForm";

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { redirect?: string };
}) {
  const redirectTo = searchParams?.redirect || "/dashboard";

  return <LoginForm redirectTo={redirectTo} />;
}
