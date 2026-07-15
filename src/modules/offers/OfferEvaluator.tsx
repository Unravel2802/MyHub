"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/src/components/AppShell";
import { PageHeader } from "@/src/components/ui/PageHeader";
import { Badge } from "@/src/components/ui/Badge";
import {
  bestOffer,
  OFFER_FACTORS,
  offerScore,
  RATING_MAX,
  RATING_MIN,
} from "@/src/modules/offers/offerScore";
import type { FactorKey, OfferRatings } from "@/src/modules/offers/offerScore";
import { hueFor } from "@/src/components/moduleHues";
import { register, unregister } from "@/src/lib/commandPalette";

type Offer = { id: number; name: string; ratings: OfferRatings };

const initialRatings = (): OfferRatings =>
  Object.fromEntries(
    OFFER_FACTORS.map((factor) => [factor.key, 5]),
  ) as OfferRatings;

export function OfferEvaluator() {
  const router = useRouter();
  const [offers, setOffers] = useState<Offer[]>([
    { id: 1, name: "Offer 1", ratings: initialRatings() },
    { id: 2, name: "Offer 2", ratings: initialRatings() },
  ]);
  const winner = bestOffer(offers);

  useEffect(() => {
    register("offers", [
      {
        id: "go-to-page",
        label: "Go to Offer Evaluator",
        keywords: ["offers", "salary", "compare"],
        action: () => router.push("/offers"),
      },
    ]);
    return () => unregister("offers");
  }, [router]);

  function updateName(id: number, name: string) {
    setOffers((current) =>
      current.map((offer) => (offer.id === id ? { ...offer, name } : offer)),
    );
  }

  function updateRating(id: number, key: FactorKey, value: number) {
    setOffers((current) =>
      current.map((offer) =>
        offer.id === id
          ? { ...offer, ratings: { ...offer.ratings, [key]: value } }
          : offer,
      ),
    );
  }

  return (
    <AppShell activeHref="/offers" title="Offer Evaluator">
      <section className="min-w-0 px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          bleed
          description="Score the whole opportunity, not just the number on the offer letter."
          eyebrow="Roadmap §12.1"
          hue={hueFor("/offers")}
          title="Offer Evaluator"
        />
        <div className="mt-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {offers.map((offer, index) => {
            const isWinner = winner?.id === offer.id;
            return (
              <article
                aria-label={offer.name || `Offer ${offer.id}`}
                className={`fade-up rounded-lg border p-5 ${isWinner ? "border-accent bg-surface" : "border-border bg-surface-subtle"}`}
                key={offer.id}
                style={{ ["--i" as string]: index }}
              >
                <div className="flex items-start justify-between gap-3">
                  <label className="grid flex-1 gap-1.5 text-sm font-medium text-body">
                    Offer name
                    <input
                      className="h-10 rounded-md border border-input bg-surface px-3 text-sm text-foreground"
                      onChange={(event) =>
                        updateName(offer.id, event.target.value)
                      }
                      value={offer.name}
                    />
                  </label>
                  {isWinner ? <Badge tone="accent">Leader</Badge> : null}
                </div>
                <p className="mt-5 text-3xl font-semibold text-accent-strong">
                  {offerScore(offer.ratings).toFixed(1)}
                  <span className="ml-1 text-sm font-normal text-muted">
                    / 10
                  </span>
                </p>
                <div className="mt-5 grid gap-3">
                  {OFFER_FACTORS.map((factor) => (
                    <label
                      className="grid gap-1 text-sm font-medium text-body"
                      key={factor.key}
                    >
                      {factor.label}
                      <span className="text-xs font-normal text-muted">
                        {factor.hint}
                      </span>
                      <select
                        aria-label={factor.label}
                        className="h-9 rounded-md border border-input bg-surface px-2 text-sm text-foreground"
                        onChange={(event) =>
                          updateRating(
                            offer.id,
                            factor.key,
                            Number(event.target.value),
                          )
                        }
                        value={offer.ratings[factor.key]}
                      >
                        {Array.from(
                          { length: RATING_MAX - RATING_MIN + 1 },
                          (_, index) => {
                            const rating = index + RATING_MIN;
                            return (
                              <option key={rating} value={rating}>
                                {rating}
                              </option>
                            );
                          },
                        )}
                      </select>
                    </label>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {offers.length < 3 ? (
            <button
              className="h-10 rounded-md border border-input bg-surface px-4 text-sm"
              onClick={() =>
                setOffers((current) => [
                  ...current,
                  {
                    id: Date.now(),
                    name: `Offer ${current.length + 1}`,
                    ratings: initialRatings(),
                  },
                ])
              }
              type="button"
            >
              Add offer
            </button>
          ) : null}
          {offers.length > 2 ? (
            <button
              className="h-10 rounded-md border border-input bg-surface px-4 text-sm"
              onClick={() => setOffers((current) => current.slice(0, -1))}
              type="button"
            >
              Remove last offer
            </button>
          ) : null}
        </div>
        <p className="mt-8 text-sm text-muted">
          Don&apos;t choose on salary alone.
        </p>
      </section>
    </AppShell>
  );
}
