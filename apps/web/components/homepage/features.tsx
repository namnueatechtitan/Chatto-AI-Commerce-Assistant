import { homepageFeatures } from "../../lib/homepage-data";
import { Card } from "../ui/Card";
import { HomepageContainer } from "./container";

export function Features() {
  return (
    <section className="pt-16 lg:pt-20" id="features">
      <HomepageContainer>
        <div className="text-center">
          <h2 className="text-[2.1rem] font-bold tracking-[-0.04em] text-slate-950">
            ฟีเจอร์ครบ จบทุกการขาย
          </h2>
          <p className="mt-3 text-base text-slate-500">
            ออกแบบมาเพื่อธุรกิจออนไลน์โดยเฉพาะ
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-5">
          {homepageFeatures.map((feature) => (
            <Card
              key={feature.title}
              className="rounded-[26px] border border-slate-100 bg-white px-5 pb-5 pt-3 shadow-[0_14px_30px_rgba(15,23,42,0.08)] transition-transform duration-200 hover:-translate-y-1"
            >
              <div className="flex flex-col items-center text-center">
                <img
                  alt={feature.title}
                  className="h-[126px] w-[126px] object-contain"
                  src={feature.imageUrl}
                />
                <h3 className="mt-1 text-lg font-semibold text-slate-950">
                  {feature.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  {feature.description}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </HomepageContainer>
    </section>
  );
}
