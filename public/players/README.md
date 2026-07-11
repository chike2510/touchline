# Player photo images

Drop real headshot files here named exactly by player id, e.g.:

    <playerId>.png

Player ids are generated at save-creation time (not fixed strings like club
ids), so the easiest way to find one is via Settings > Export backup file,
which dumps the full save as JSON — search it for the player's name to get
their id. The `PlayerPhoto` component (`src/components/ui/PlayerPhoto.tsx`)
falls back to a silhouette icon if no matching file exists.

Recommended: square PNG, ~256x256, headshot centered.
