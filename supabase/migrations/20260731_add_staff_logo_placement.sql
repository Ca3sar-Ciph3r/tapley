-- 20260731_add_staff_logo_placement.sql
--
-- Per-card control of where the company logo sits, and how large it is.
--
-- Position has to live on the staff card rather than the company because the
-- thing it has to work around is the photograph, and every staff member's photo
-- is composed differently. A logo pinned top-left disappears into a light
-- window behind one person's shoulder and sits perfectly on the next. One
-- company-wide corner cannot be right for everybody.
--
-- Size is here for the same reason — a mark that reads well over a busy photo
-- may want to be smaller than the company default, or larger over a plain one.
--
-- Both are NULLABLE on purpose. NULL means "inherit", not "left" or "medium":
-- a company that changes its default logo size later should see that change
-- flow through to every card that never overrode it. Defaulting these columns
-- would silently freeze today's value onto all 6 existing cards and break that.
--
-- Position only has an effect when the card has a photo. With no photo the
-- logo replaces the initials in the centre of the hero, which is the whole
-- hero — there is no corner to move it to.
--
-- Additive, nullable, no data rewritten.

alter table staff_cards
  add column if not exists logo_position text,
  add column if not exists logo_size text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'staff_cards_logo_position_check'
  ) then
    alter table staff_cards
      add constraint staff_cards_logo_position_check
      check (logo_position is null or logo_position in ('left', 'center', 'right'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'staff_cards_logo_size_check'
  ) then
    alter table staff_cards
      add constraint staff_cards_logo_size_check
      check (logo_size is null or logo_size in ('s', 'm', 'l'));
  end if;
end $$;

comment on column staff_cards.logo_position is
  'Where the company logo sits over this card''s photo: left, center or right. NULL inherits the default. No effect when the card has no photo — the logo then replaces the initials centrally.';

comment on column staff_cards.logo_size is
  'Overrides companies.logo_size for this card only. NULL inherits the company setting.';
