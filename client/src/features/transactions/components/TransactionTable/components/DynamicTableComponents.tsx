import { useRef, useLayoutEffect } from 'react';

export const DynamicHeightRow = ({
  height,
  children,
}: {
  height: number;
  children: React.ReactNode;
}) => {
  const ref = useRef<HTMLTableRowElement>(null);
  useLayoutEffect(() => {
    if (ref.current) ref.current.style.height = `${height}px`;
  }, [height]);
  return <tr ref={ref}>{children}</tr>;
};

export const DynamicTh = ({
  width,
  children,
  className,
  ...props
}: React.ThHTMLAttributes<HTMLTableHeaderCellElement> & { width?: number }) => {
  const ref = useRef<HTMLTableHeaderCellElement>(null);
  useLayoutEffect(() => {
    if (ref.current && width) {
      ref.current.style.setProperty('--column-width', `${width}px`);
    }
  }, [width]);
  return (
    <th ref={ref} className={className} {...props}>
      {children}
    </th>
  );
};
