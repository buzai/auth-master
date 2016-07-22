CREATE TABLE public.kb
(
  id serial NOT NULL,
  old_id integer,
  category integer NOT NULL,
  type character varying(20) NOT NULL,
  title character varying(1024) NOT NULL,
  content text NOT NULL,
  createdby integer,
  createdon timestamp with time zone NOT NULL DEFAULT now(),
  enabled integer NOT NULL DEFAULT 1,
  CONSTRAINT kb_pkey PRIMARY KEY (id)
)
WITH (
  OIDS=FALSE
);
ALTER TABLE public.kb OWNER TO postgres;
