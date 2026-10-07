# Raw model output mock

Run the generator after starting the game-role API:

    npm run mock:recognition

The default output is resources/mock/recognition/raw-model-output.json.

Each frame contains raw label, confidence, pixel bbox, and CVAT attributes.
Map and battle scenes are inferred only from the configured prediction labels.

Configured attributes:

- board_die: index 0-4 and value 1-10/null;
- round_slot: value 1-20/null/-1 and index 0-19;
- player_head_count: text value and left/right/null side;
- map_character: text value containing a game role ID;
- battle_character: text value containing a game role ID and side;
- card_dice_value: numeric value 1-50, index 0-5, and side;
- card_point_value: value 1-10/null, index 0-4, and side.

Names and avatars are not raw model output. Consumers resolve character value
IDs using the game-role snapshot identified by roleSnapshotVersion.
