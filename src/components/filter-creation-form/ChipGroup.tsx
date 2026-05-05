import React from "react";

type Option = { id: string; label: string };

type ChipGroupProps =
  | {
      options: Option[];
      value: string;
      onChange: (v: string) => void;
      multiple?: false;
      highlight?: "yellow";
    }
  | {
      options: Option[];
      value: string[];
      onChange: (v: string[]) => void;
      multiple: true;
      highlight?: "yellow";
    };

export const ChipGroup: React.FC<ChipGroupProps> = (props) => {
  const { options, highlight } = props;

  const isActive = (id: string) => {
    return props.multiple
      ? props.value.includes(id)
      : props.value === id;
  };

  const toggle = (id: string) => {
    if (props.multiple) {
      const has = props.value.includes(id);
      const next = has
        ? props.value.filter((x) => x !== id)
        : [...props.value, id];
      props.onChange(next);
    } else {
      props.onChange(id);
    }
  };

  return (
    <div className="chip-group">
      {options.map((o) => {
        const active = isActive(o.id);
        const classes = [
          "chip-btn",
          active ? "active" : "",
          highlight && active ? highlight : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <button
            key={o.id}
            type="button"
            className={classes}
            onClick={() => toggle(o.id)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
};
