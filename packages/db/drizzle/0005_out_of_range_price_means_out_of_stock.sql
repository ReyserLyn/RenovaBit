-- The supplier marks "no stock" by publishing a bogus price (negative, zero or
-- an absurd value like 10M/100M). For those products the correct state is OUT
-- OF STOCK: keep the row and its price untouched so everything returns to
-- normal when the feed publishes a sane price again — the sync now sets stock
-- to 0 for existing products with an invalid feed price.
DO $$ DECLARE n int; BEGIN
	UPDATE "products"
	SET "stock" = 0
	WHERE "supplier_price" > 50000 OR "price" > 50000;
	GET DIAGNOSTICS n = ROW_COUNT;
	IF n > 0 THEN RAISE NOTICE '[0005] set stock = 0 for % product(s) with an out-of-range feed price', n; END IF;
END $$;
