ALTER TABLE "material_presets"
  ADD COLUMN "group" TEXT NOT NULL DEFAULT 'Other';

WITH catalog(name) AS (
  VALUES
    ('Tops'), ('Bottoms'), ('Dresses'), ('Outerwear'), ('Knitwear'),
    ('Accessories'), ('Bags'), ('Footwear'), ('Swimwear'), ('Activewear'),
    ('Underwear'), ('Sleepwear'), ('Other')
), catalog_rows AS (
  SELECT
    o.id AS organisation_id,
    c.name,
    md5(o.id || ':category:' || c.name) AS hash
  FROM organisations o CROSS JOIN catalog c
)
INSERT INTO categories ("id", "organisationId", "name")
SELECT
  substr(hash, 1, 8) || '-' || substr(hash, 9, 4) || '-' || substr(hash, 13, 4) || '-' ||
  substr(hash, 17, 4) || '-' || substr(hash, 21, 12),
  organisation_id,
  name
FROM catalog_rows
ON CONFLICT ("organisationId", "name") DO NOTHING;

WITH catalog(code, name) AS (
  VALUES
    ('AF','Afghanistan'), ('AL','Albania'), ('DZ','Algeria'), ('AD','Andorra'),
    ('AR','Argentina'), ('AM','Armenia'), ('AU','Australia'), ('AT','Austria'),
    ('AZ','Azerbaijan'), ('BD','Bangladesh'), ('BY','Belarus'), ('BE','Belgium'),
    ('BA','Bosnia and Herzegovina'), ('BR','Brazil'), ('BG','Bulgaria'), ('KH','Cambodia'),
    ('CA','Canada'), ('CL','Chile'), ('CN','China'), ('CO','Colombia'), ('HR','Croatia'),
    ('CY','Cyprus'), ('CZ','Czech Republic'), ('DK','Denmark'), ('EC','Ecuador'),
    ('EG','Egypt'), ('EE','Estonia'), ('ET','Ethiopia'), ('FI','Finland'), ('FR','France'),
    ('GE','Georgia'), ('DE','Germany'), ('GH','Ghana'), ('GR','Greece'), ('GT','Guatemala'),
    ('HN','Honduras'), ('HK','Hong Kong'), ('HU','Hungary'), ('IS','Iceland'), ('IN','India'),
    ('ID','Indonesia'), ('IE','Ireland'), ('IL','Israel'), ('IT','Italy'), ('JP','Japan'),
    ('JO','Jordan'), ('KE','Kenya'), ('XK','Kosovo'), ('LV','Latvia'), ('LI','Liechtenstein'),
    ('LT','Lithuania'), ('LU','Luxembourg'), ('MY','Malaysia'), ('MT','Malta'), ('MX','Mexico'),
    ('MD','Moldova'), ('MC','Monaco'), ('ME','Montenegro'), ('MA','Morocco'), ('NP','Nepal'),
    ('MK','North Macedonia'), ('NL','Netherlands'), ('NZ','New Zealand'), ('NG','Nigeria'),
    ('NO','Norway'), ('PK','Pakistan'), ('PA','Panama'), ('PE','Peru'), ('PH','Philippines'),
    ('PL','Poland'), ('PT','Portugal'), ('RO','Romania'), ('RU','Russia'), ('SM','San Marino'),
    ('SA','Saudi Arabia'), ('RS','Serbia'), ('SG','Singapore'), ('SK','Slovakia'),
    ('SI','Slovenia'), ('ZA','South Africa'), ('KR','South Korea'), ('ES','Spain'),
    ('LK','Sri Lanka'), ('SE','Sweden'), ('CH','Switzerland'), ('TW','Taiwan'),
    ('TH','Thailand'), ('TN','Tunisia'), ('TR','Turkey'), ('UA','Ukraine'),
    ('AE','United Arab Emirates'), ('GB','United Kingdom'), ('US','United States'),
    ('UY','Uruguay'), ('VA','Vatican City'), ('VE','Venezuela'), ('VN','Vietnam')
), catalog_rows AS (
  SELECT
    o.id AS organisation_id,
    c.code,
    c.name,
    md5(o.id || ':country:' || c.code) AS hash
  FROM organisations o CROSS JOIN catalog c
)
INSERT INTO countries ("id", "organisationId", "code", "name")
SELECT
  substr(hash, 1, 8) || '-' || substr(hash, 9, 4) || '-' || substr(hash, 13, 4) || '-' ||
  substr(hash, 17, 4) || '-' || substr(hash, 21, 12),
  organisation_id,
  code,
  name
FROM catalog_rows
ON CONFLICT ("organisationId", "code") DO NOTHING;

WITH catalog("group", name) AS (
  VALUES
    ('Cotton','Organic Cotton'), ('Cotton','Cotton'), ('Cotton','Recycled Cotton'),
    ('Plant-based fibers','Linen'), ('Plant-based fibers','Hemp'), ('Plant-based fibers','Bamboo'),
    ('Wool & animal fibers','Wool'), ('Wool & animal fibers','Merino Wool'),
    ('Wool & animal fibers','Cashmere'), ('Wool & animal fibers','Silk'),
    ('Synthetics','Polyester'), ('Synthetics','Recycled Polyester'), ('Synthetics','Nylon'),
    ('Synthetics','Recycled Nylon'), ('Synthetics','Elastane'), ('Synthetics','Spandex'),
    ('Cellulosic fibers','Viscose'), ('Cellulosic fibers','Modal'),
    ('Cellulosic fibers','Tencel/Lyocell'), ('Leather','Leather'),
    ('Leather','Full Grain Leather'), ('Leather','Top Grain Leather'),
    ('Leather','Genuine Leather'), ('Leather','Suede'), ('Leather','Vegan Leather')
), catalog_rows AS (
  SELECT
    o.id AS organisation_id,
    c."group",
    c.name,
    md5(o.id || ':material:' || c.name) AS hash
  FROM organisations o CROSS JOIN catalog c
)
INSERT INTO material_presets ("id", "organisationId", "name", "group")
SELECT
  substr(hash, 1, 8) || '-' || substr(hash, 9, 4) || '-' || substr(hash, 13, 4) || '-' ||
  substr(hash, 17, 4) || '-' || substr(hash, 21, 12),
  organisation_id,
  name,
  "group"
FROM catalog_rows
ON CONFLICT ("organisationId", "name") DO UPDATE SET "group" = EXCLUDED."group";
