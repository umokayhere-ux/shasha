"use client";

import { useState } from "react";
import {
  COMPLAINT_CATEGORIES,
  buildComplaintMessage,
  whatsappLink,
} from "@/lib/support";

export interface ComplaintOrderOption {
  reference: string;
  summary: string;
}

/**
 * Composes a complaint and hands it to WhatsApp.
 *
 * The message is built as the customer types and shown in full before sending,
 * so nobody is surprised by what lands in the operator's inbox. Submitting
 * opens WhatsApp rather than posting anywhere — there is no server round trip.
 */
export function ComplaintForm({
  whatsappNumber,
  business,
  customerName,
  customerPhone,
  orders,
}: {
  whatsappNumber: string | null;
  business: string;
  customerName: string;
  customerPhone: string | null;
  orders: ComplaintOrderOption[];
}) {
  const [category, setCategory] = useState<string>(COMPLAINT_CATEGORIES[0]);
  const [reference, setReference] = useState<string>(orders[0]?.reference ?? "");
  const [message, setMessage] = useState("");

  const trimmed = message.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < 10;
  const ready = trimmed.length >= 10;

  const selected = orders.find((o) => o.reference === reference) ?? null;
  const preview = buildComplaintMessage({
    business,
    customerName,
    customerPhone,
    category,
    orderReference: selected?.reference ?? null,
    orderSummary: selected?.summary ?? null,
    message: trimmed || "…",
  });

  if (!whatsappNumber) {
    return (
      <div className="card">
        <p className="alert-warn">
          Support chat is not set up yet. Please contact {business} directly.
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <label className="label" htmlFor="category">
        What went wrong?
      </label>
      <select
        id="category"
        className="input"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
      >
        {COMPLAINT_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      {orders.length > 0 && (
        <>
          <label className="label mt-4" htmlFor="order">
            Which order? <span className="muted font-normal">(optional)</span>
          </label>
          <select
            id="order"
            className="input"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          >
            <option value="">Not about a specific order</option>
            {orders.map((o) => (
              <option key={o.reference} value={o.reference}>
                {o.summary}
              </option>
            ))}
          </select>
        </>
      )}

      <label className="label mt-4" htmlFor="message">
        Tell us what happened
      </label>
      <textarea
        id="message"
        className="input"
        rows={4}
        placeholder="I paid for 1GB but it has not arrived after 30 minutes…"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      {tooShort && (
        <p className="muted mt-1 text-xs">
          Please add a little more detail so we can help faster.
        </p>
      )}

      <details className="mt-4">
        <summary className="cursor-pointer text-xs font-semibold" style={{ color: "var(--brand)" }}>
          Preview the message
        </summary>
        <pre
          className="mt-2 whitespace-pre-wrap rounded-xl p-3 text-xs"
          style={{ background: "var(--surface-2)", color: "var(--text)" }}
        >
          {preview}
        </pre>
      </details>

      {/*
        An anchor, not a button with window.open: mobile browsers block
        programmatic opens that are not a direct user gesture on a link, which
        is exactly where this feature lives.
      */}
      <a
        href={ready ? whatsappLink(whatsappNumber, preview) : undefined}
        target="_blank"
        rel="noopener noreferrer"
        aria-disabled={!ready}
        className="btn-primary mt-5 w-full"
        style={ready ? undefined : { opacity: 0.6, pointerEvents: "none" }}
        onClick={(e) => {
          if (!ready) e.preventDefault();
        }}
      >
        Send on WhatsApp
      </a>

      <p className="muted mt-3 text-center text-xs">
        This opens WhatsApp with your complaint ready to send.
      </p>
    </div>
  );
}
