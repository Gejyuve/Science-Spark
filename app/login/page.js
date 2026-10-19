import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import LoginForm from "./LoginForm";

export const metadata = { title: "Нэвтрэх · Science Spark" };

export default async function LoginPage() {
  if (await getUser()) redirect("/");
  return <LoginForm />;
}
