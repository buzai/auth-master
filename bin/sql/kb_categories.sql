CREATE TABLE public.kb_categories
(
  id serial NOT NULL,
  type character varying(20) NOT NULL,
  title character varying(1024) NOT NULL,
  description text,
  parent integer,
  enabled integer NOT NULL,
  CONSTRAINT kb_categories_id_pkey PRIMARY KEY(id)
)
WITH (
  OIDS=FALSE
);
ALTER TABLE public.kb_categories OWNER TO postgres;
