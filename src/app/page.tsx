import { redirect } from "next/navigation";

export default function Home() {
  // middleware가 인증 안 된 사용자를 /login으로 자동 바운스함
  redirect("/dashboard");
}
