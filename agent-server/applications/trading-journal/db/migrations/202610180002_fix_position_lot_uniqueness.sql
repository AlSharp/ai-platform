-- migrate:up

ALTER TABLE position_lots
    DROP CONSTRAINT position_lots_leg_price_unique;


-- migrate:down

ALTER TABLE position_lots
    ADD CONSTRAINT position_lots_leg_price_unique
    UNIQUE (opening_leg_id, fill_price);