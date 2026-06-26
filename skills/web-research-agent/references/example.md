# Example

## Caller inputs

```json
{
  "rows": [
    { "company": "OpenAI", "claim": "GPT-4 was released in March 2023" },
    { "company": "Stripe", "claim": "Stripe headquarters is in San Francisco" }
  ],
  "prompt": "verify the claim against current public information",
  "sources": [],
  "outputSchema": {}
}
```

## Expected output (abbreviated)

```json
{
  "enrichedRows": [
    {
      "company": "OpenAI",
      "claim": "GPT-4 was released in March 2023",
      "researchNotes": [
        "Verified — GPT-4 was announced by OpenAI on 2023-03-14 (https://openai.com/index/gpt-4/).",
        "Claim date is correct at month granularity."
      ]
    },
    {
      "company": "Stripe",
      "claim": "Stripe headquarters is in San Francisco",
      "researchNotes": [
        "Verified — Stripe's headquarters is at 510 Townsend St, San Francisco, CA (https://stripe.com/contact)."
      ]
    }
  ],
  "extractionNotes": "Enriched 2 rows with researchNotes from web_search results; visited 4 unique URLs; 0 failures.",
  "failures": [],
  "webChecks": [
    { "url": "https://openai.com/index/gpt-4/", "reachable": true },
    { "url": "https://stripe.com/contact", "reachable": true },
    { "url": "https://en.wikipedia.org/wiki/GPT-4", "reachable": true, "note": "supplementary corroboration" },
    { "url": "https://en.wikipedia.org/wiki/Stripe%2C_Inc.", "reachable": true, "note": "supplementary corroboration" }
  ]
}
```
