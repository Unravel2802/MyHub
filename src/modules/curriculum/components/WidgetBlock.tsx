import { widgetRegistry } from "../widgets/registry";

export function WidgetBlock({ raw }: { raw: string }) {
  const id = raw.trim();
  const Widget = Object.hasOwn(widgetRegistry, id) ? widgetRegistry[id] : null;
  return Widget ? (
    <Widget />
  ) : (
    <p className="my-5 text-danger">Widget not found: {id}</p>
  );
}
