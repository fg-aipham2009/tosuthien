/** JSON-LD schema.org — cùng cấu trúc Yoast trên tosuthien.com. */
export function JsonLd({ data }: { data: Record<string, unknown> | object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
