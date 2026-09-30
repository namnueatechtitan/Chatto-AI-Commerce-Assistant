import { redirect } from "next/navigation";
import { getCurrentUser } from "../../../lib/auth";
import styles from "../../plain-auth.module.css";
import { CreateMerchantForm } from "./create-merchant-form";

export default async function NewMerchantPage() {
  if (!await getCurrentUser()) redirect("/login");
  return (
    <main className={styles.page}>
      <h1>สร้างร้านค้า</h1>
      <CreateMerchantForm />
    </main>
  );
}
