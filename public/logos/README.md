# Club crest images

Drop real crest files here named exactly by club id, e.g.:

    club-arsenal.png
    club-man-city.png
    club-liverpool.png

Club ids match `id` in `src/data/leagues/*.json`. The `ClubCrest` component
(`src/components/ui/ClubCrest.tsx`) automatically picks up a file here if it
exists; if it 404s, it falls back to a colored initials badge, so you can add
crests gradually without breaking anything.

Recommended: square PNG, transparent background, ~256x256.
