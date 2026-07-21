--
-- PostgreSQL database dump
--

\restrict Lrjl9MRr7lYdcN7npZbwTnwJ0BlbvJP3Iu8QBV0v1u090gUk17k3F2lvexb0Nbf

-- Dumped from database version 16.14 (Debian 16.14-1.pgdg12+1)
-- Dumped by pg_dump version 16.14 (Debian 16.14-1.pgdg12+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: vector; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;


--
-- Name: EXTENSION vector; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION vector IS 'vector data type and ivfflat and hnsw access methods';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: centers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.centers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text,
    temple_name text NOT NULL,
    abbot_name text,
    address text,
    phone text,
    abbot_phone text,
    google_maps_url text,
    lat double precision,
    lng double precision,
    activity_hours text,
    rules text,
    customs text,
    main_image_url text,
    gallery_images jsonb DEFAULT '[]'::jsonb NOT NULL,
    detail_content text,
    sort_order integer DEFAULT 0,
    is_published boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    abbot_rank text,
    abbot_title text,
    org_role text,
    gender_section text,
    region text,
    country_code text,
    province text
);


--
-- Name: COLUMN centers.gender_section; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.centers.gender_section IS 'TANG | NI';


--
-- Name: COLUMN centers.region; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.centers.region IS 'BAC | TRUNG | NAM | NUOC_NGOAI';


--
-- Name: courses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.courses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    start_date date,
    end_date date,
    center_id uuid,
    contact text,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    type text,
    recurrence text,
    day_start integer,
    day_end integer,
    weekday integer,
    schedule_text text,
    sort_order integer DEFAULT 0 NOT NULL
);


--
-- Name: COLUMN courses.type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.courses.type IS 'REGULAR | SPRING | WINTER | AN_CU | OTHER';


--
-- Name: COLUMN courses.recurrence; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.courses.recurrence IS 'ONCE | WEEKLY | MONTHLY_RANGE | YEARLY | SELF_PRACTICE';


--
-- Name: media_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.media_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    description text,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: mp3_favorites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mp3_favorites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    device_id text NOT NULL,
    mp3_track_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: mp3_tracks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mp3_tracks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category_id uuid NOT NULL,
    title text NOT NULL,
    year integer NOT NULL,
    recorded_at date,
    location text,
    description text,
    folder_path text NOT NULL,
    filename text NOT NULL,
    storage_path text NOT NULL,
    public_url text NOT NULL,
    duration_sec integer,
    file_size_bytes bigint,
    sort_order integer DEFAULT 0,
    is_published boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: passage_embeddings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.passage_embeddings (
    passage_id uuid NOT NULL,
    embedding public.vector(384) NOT NULL,
    model text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: passages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.passages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rag_source_id uuid NOT NULL,
    page_num integer,
    chunk_type text DEFAULT 'prose'::text NOT NULL,
    question_num integer,
    content text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT passages_chunk_type_check CHECK ((chunk_type = ANY (ARRAY['qa'::text, 'prose'::text, 'verse'::text])))
);


--
-- Name: pdf_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pdf_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    volume text,
    author text DEFAULT 'Hòa thượng Thích Duy Lực'::text NOT NULL,
    filename text NOT NULL,
    folder_path text DEFAULT 'pdf/'::text NOT NULL,
    storage_path text NOT NULL,
    public_url text NOT NULL,
    page_count integer,
    file_size_bytes bigint,
    cover_image_url text,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: rag_sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rag_sources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    volume text,
    author text DEFAULT 'Hòa thượng Thích Duy Lực'::text NOT NULL,
    source_file text NOT NULL,
    folder_path text DEFAULT 'text/'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    chunk_count integer DEFAULT 0,
    ingested_at timestamp with time zone,
    embedded_at timestamp with time zone,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT rag_sources_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'ingested'::text, 'embedded'::text])))
);


--
-- Name: reading_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reading_progress (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    device_id text NOT NULL,
    pdf_file_id uuid NOT NULL,
    last_page integer DEFAULT 1 NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT reading_progress_last_page_check CHECK ((last_page >= 1))
);


--
-- Name: youtube_videos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.youtube_videos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category_id uuid NOT NULL,
    title text NOT NULL,
    youtube_id text NOT NULL,
    channel text DEFAULT 'Hoà thượng Thích Duy Lực'::text,
    year integer,
    published_at date,
    description text,
    sort_order integer DEFAULT 0,
    is_published boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: centers centers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.centers
    ADD CONSTRAINT centers_pkey PRIMARY KEY (id);


--
-- Name: centers centers_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.centers
    ADD CONSTRAINT centers_slug_key UNIQUE (slug);


--
-- Name: courses courses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_pkey PRIMARY KEY (id);


--
-- Name: media_categories media_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_categories
    ADD CONSTRAINT media_categories_pkey PRIMARY KEY (id);


--
-- Name: media_categories media_categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_categories
    ADD CONSTRAINT media_categories_slug_key UNIQUE (slug);


--
-- Name: mp3_favorites mp3_favorites_device_id_mp3_track_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mp3_favorites
    ADD CONSTRAINT mp3_favorites_device_id_mp3_track_id_key UNIQUE (device_id, mp3_track_id);


--
-- Name: mp3_favorites mp3_favorites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mp3_favorites
    ADD CONSTRAINT mp3_favorites_pkey PRIMARY KEY (id);


--
-- Name: mp3_tracks mp3_tracks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mp3_tracks
    ADD CONSTRAINT mp3_tracks_pkey PRIMARY KEY (id);


--
-- Name: mp3_tracks mp3_tracks_storage_path_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mp3_tracks
    ADD CONSTRAINT mp3_tracks_storage_path_key UNIQUE (storage_path);


--
-- Name: passage_embeddings passage_embeddings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.passage_embeddings
    ADD CONSTRAINT passage_embeddings_pkey PRIMARY KEY (passage_id);


--
-- Name: passages passages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.passages
    ADD CONSTRAINT passages_pkey PRIMARY KEY (id);


--
-- Name: pdf_files pdf_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdf_files
    ADD CONSTRAINT pdf_files_pkey PRIMARY KEY (id);


--
-- Name: pdf_files pdf_files_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdf_files
    ADD CONSTRAINT pdf_files_slug_key UNIQUE (slug);


--
-- Name: pdf_files pdf_files_storage_path_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdf_files
    ADD CONSTRAINT pdf_files_storage_path_key UNIQUE (storage_path);


--
-- Name: rag_sources rag_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rag_sources
    ADD CONSTRAINT rag_sources_pkey PRIMARY KEY (id);


--
-- Name: rag_sources rag_sources_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rag_sources
    ADD CONSTRAINT rag_sources_slug_key UNIQUE (slug);


--
-- Name: rag_sources rag_sources_source_file_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rag_sources
    ADD CONSTRAINT rag_sources_source_file_key UNIQUE (source_file);


--
-- Name: reading_progress reading_progress_device_id_pdf_file_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_progress
    ADD CONSTRAINT reading_progress_device_id_pdf_file_id_key UNIQUE (device_id, pdf_file_id);


--
-- Name: reading_progress reading_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_progress
    ADD CONSTRAINT reading_progress_pkey PRIMARY KEY (id);


--
-- Name: youtube_videos youtube_videos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.youtube_videos
    ADD CONSTRAINT youtube_videos_pkey PRIMARY KEY (id);


--
-- Name: idx_centers_province; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_centers_province ON public.centers USING btree (province);


--
-- Name: idx_centers_region; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_centers_region ON public.centers USING btree (region);


--
-- Name: idx_centers_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_centers_sort ON public.centers USING btree (sort_order);


--
-- Name: idx_courses_center; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_courses_center ON public.courses USING btree (center_id);


--
-- Name: idx_courses_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_courses_type ON public.courses USING btree (type);


--
-- Name: idx_mp3_favorites_device; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mp3_favorites_device ON public.mp3_favorites USING btree (device_id);


--
-- Name: idx_mp3_favorites_track; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mp3_favorites_track ON public.mp3_favorites USING btree (mp3_track_id);


--
-- Name: idx_mp3_tracks_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mp3_tracks_category ON public.mp3_tracks USING btree (category_id);


--
-- Name: idx_mp3_tracks_category_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mp3_tracks_category_year ON public.mp3_tracks USING btree (category_id, year DESC);


--
-- Name: idx_mp3_tracks_folder; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mp3_tracks_folder ON public.mp3_tracks USING btree (folder_path);


--
-- Name: idx_mp3_tracks_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mp3_tracks_year ON public.mp3_tracks USING btree (year);


--
-- Name: idx_passage_embeddings_hnsw; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_passage_embeddings_hnsw ON public.passage_embeddings USING hnsw (embedding public.vector_cosine_ops);


--
-- Name: idx_passages_chunk_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_passages_chunk_type ON public.passages USING btree (chunk_type);


--
-- Name: idx_passages_fts; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_passages_fts ON public.passages USING gin (to_tsvector('simple'::regconfig, content));


--
-- Name: idx_passages_rag_page; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_passages_rag_page ON public.passages USING btree (rag_source_id, page_num);


--
-- Name: idx_pdf_files_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pdf_files_sort ON public.pdf_files USING btree (sort_order);


--
-- Name: idx_rag_sources_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rag_sources_sort ON public.rag_sources USING btree (sort_order);


--
-- Name: idx_rag_sources_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rag_sources_status ON public.rag_sources USING btree (status);


--
-- Name: idx_reading_progress_device; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reading_progress_device ON public.reading_progress USING btree (device_id);


--
-- Name: idx_reading_progress_pdf; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reading_progress_pdf ON public.reading_progress USING btree (pdf_file_id);


--
-- Name: idx_youtube_videos_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_youtube_videos_category ON public.youtube_videos USING btree (category_id);


--
-- Name: idx_youtube_videos_category_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_youtube_videos_category_year ON public.youtube_videos USING btree (category_id, year DESC);


--
-- Name: idx_youtube_videos_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_youtube_videos_year ON public.youtube_videos USING btree (year);


--
-- Name: courses courses_center_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_center_id_fkey FOREIGN KEY (center_id) REFERENCES public.centers(id) ON DELETE SET NULL;


--
-- Name: mp3_favorites mp3_favorites_mp3_track_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mp3_favorites
    ADD CONSTRAINT mp3_favorites_mp3_track_id_fkey FOREIGN KEY (mp3_track_id) REFERENCES public.mp3_tracks(id) ON DELETE CASCADE;


--
-- Name: mp3_tracks mp3_tracks_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mp3_tracks
    ADD CONSTRAINT mp3_tracks_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.media_categories(id) ON DELETE RESTRICT;


--
-- Name: passage_embeddings passage_embeddings_passage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.passage_embeddings
    ADD CONSTRAINT passage_embeddings_passage_id_fkey FOREIGN KEY (passage_id) REFERENCES public.passages(id) ON DELETE CASCADE;


--
-- Name: passages passages_rag_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.passages
    ADD CONSTRAINT passages_rag_source_id_fkey FOREIGN KEY (rag_source_id) REFERENCES public.rag_sources(id) ON DELETE CASCADE;


--
-- Name: reading_progress reading_progress_pdf_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_progress
    ADD CONSTRAINT reading_progress_pdf_file_id_fkey FOREIGN KEY (pdf_file_id) REFERENCES public.pdf_files(id) ON DELETE CASCADE;


--
-- Name: youtube_videos youtube_videos_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.youtube_videos
    ADD CONSTRAINT youtube_videos_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.media_categories(id) ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict Lrjl9MRr7lYdcN7npZbwTnwJ0BlbvJP3Iu8QBV0v1u090gUk17k3F2lvexb0Nbf

