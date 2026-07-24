/**
 * หน้าที่ไฟล์: ไฟล์นี้เก็บคอมโพเนนต์ส่วน footer ของหน้า landing page
 */

import { Clock3, Facebook, Mail, MapPin, PhoneCall, Youtube } from "lucide-react";
import Link from "next/link";

import { footerLinkGroups } from "../../lib/homepage-data";
import { Brand } from "./brand";
import { HomepageContainer } from "./container";

/**
 * หน้าที่: คอมโพเนนต์นี้เรนเดอร์ส่วนท้ายของ หน้าเว็บ
 */
export function Footer() {
  return (
    <footer className="bg-[#061B11] pb-6 pt-14 text-white" id="contact">
      <HomepageContainer>
        <div className="grid gap-10 xl:grid-cols-[260px_1px_1fr]">
          <div>
            <Brand className="text-white" dark href="/" />
            <p className="mt-6 max-w-[180px] text-sm leading-7 text-white/75">
              AI ผู้ช่วยตอบแชท ที่เข้าใจธุรกิจของคุณ เพิ่มยอดขาย ลดงานแอดมิน ตลอด 24 ชั่วโมง
            </p>
            <div className="mt-6 flex items-center gap-4 text-white">
              <div className="flex size-11 items-center justify-center rounded-full bg-white/10">
                <Mail className="size-5" />
              </div>
              <div className="flex size-10 items-center justify-center rounded-full bg-white/10">
                <Facebook className="size-5" />
              </div>
              <div className="flex size-11 items-center justify-center rounded-full bg-white/10">
                <Youtube className="size-5" />
              </div>
              <div className="flex size-10 items-center justify-center rounded-full bg-white/10 text-sm font-semibold">
                ♪
              </div>
            </div>
          </div>

          <div className="hidden bg-white/10 xl:block" />

          <div className="grid gap-10 md:grid-cols-2 xl:grid-cols-4">
            {footerLinkGroups.map((group) => (
              <div key={group.title}>
                <div className="text-base font-medium">{group.title}</div>
                <div className="mt-5 space-y-3">
                  {group.links.map((link) => (
                    <Link
                      key={link}
                      className="flex items-center justify-between gap-3 text-sm text-white/70 transition-colors hover:text-white"
                      href="#"
                    >
                      {link}
                      <span>›</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}

            <div>
              <div className="text-base font-medium">Contact Us</div>
              <div className="mt-5 space-y-5 text-sm text-white/75">
                <div className="flex items-start gap-3">
                  <Mail className="mt-1 size-4 shrink-0" />
                  <span>chattoaiofficial@gmail.com</span>
                </div>
                <div className="flex items-start gap-3">
                  <PhoneCall className="mt-1 size-4 shrink-0" />
                  <span>02-967-1224</span>
                </div>
                <div className="flex items-start gap-3">
                  <Clock3 className="mt-1 size-4 shrink-0" />
                  <span>จันทร์-ศุกร์ 09.00-18.00</span>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="mt-1 size-4 shrink-0" />
                  <span>Bangkok, Thailand</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-5 text-xs text-white/60 md:flex-row md:items-center md:justify-between">
          <div>© 2025 Chatto AI Commerce Assistant. All rights reserved</div>
          <div className="flex flex-wrap items-center gap-6">
            <Link href="#">Terms of Service</Link>
            <Link href="#">Data Policy</Link>
            <Link href="#">Language</Link>
          </div>
        </div>
      </HomepageContainer>
    </footer>
  );
}
