struct MemoryBackend {
  width: u16,
  height: u16,
  // Row-major grid of chars
  grid: Vec<Vec<char>>,
  cursor: Position,
}

impl MemoryBackend {
  #[allow(dead_code)]
  fn new(width: u16, height: u16) -> Self {
    let w = width as usize;
    let h = height as usize;
    let grid = vec![vec![' '; w]; h];
    Self {
      width,
      height,
      grid,
      cursor: Position { x: 0, y: 0 },
    }
  }
}

impl Write for MemoryBackend {
  fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
    // Ignore raw writes; our draw() receives structured cells.
    Ok(buf.len())
  }
  fn flush(&mut self) -> io::Result<()> {
    Ok(())
  }
}

impl Backend for MemoryBackend {
  fn draw<'a, I>(&mut self, content: I) -> io::Result<()>
  where
    I: Iterator<Item = (u16, u16, &'a Cell)>,
  {
    for (x, y, cell) in content {
      if (x as usize) < self.grid[0].len() && (y as usize) < self.grid.len() {
        let ch = cell.symbol().chars().next().unwrap_or(' ');
        self.grid[y as usize][x as usize] = ch;
        self.cursor = Position { x, y };
      }
    }
    Ok(())
  }

  fn hide_cursor(&mut self) -> io::Result<()> {
    Ok(())
  }

  fn show_cursor(&mut self) -> io::Result<()> {
    Ok(())
  }

  fn get_cursor_position(&mut self) -> io::Result<Position> {
    Ok(self.cursor)
  }

  fn set_cursor_position<P: Into<Position>>(&mut self, position: P) -> io::Result<()> {
    self.cursor = position.into();
    Ok(())
  }

  fn clear(&mut self) -> io::Result<()> {
    for row in &mut self.grid {
      for ch in row.iter_mut() {
        *ch = ' ';
      }
    }
    Ok(())
  }

  fn clear_region(&mut self, _clear_type: ClearType) -> io::Result<()> {
    self.clear()
  }

  fn append_lines(&mut self, _line_count: u16) -> io::Result<()> {
    Ok(())
  }

  fn size(&self) -> io::Result<Size> {
    Ok(Size::new(self.width, self.height))
  }

  fn window_size(&mut self) -> io::Result<WindowSize> {
    Ok(WindowSize {
      columns_rows: Size::new(self.width, self.height),
      pixels: Size {
        width: 640,
        height: 480,
      },
    })
  }

  fn flush(&mut self) -> io::Result<()> {
    Ok(())
  }

  fn scroll_region_up(&mut self, _region: std::ops::Range<u16>, _scroll_by: u16) -> io::Result<()> {
    Ok(())
  }

  fn scroll_region_down(
    &mut self,
    _region: std::ops::Range<u16>,
    _scroll_by: u16,
  ) -> io::Result<()> {
    Ok(())
  }
}

// --- VT100-based backend for TUI snapshots ---
struct Vt100Backend {
  inner: CrosstermBackend<vt100::Parser>,
}

impl Vt100Backend {
  fn new(width: u16, height: u16) -> Self {
    Self {
      inner: CrosstermBackend::new(vt100::Parser::new(height, width, 0)),
    }
  }

  fn as_string(&self) -> String {
    self.inner.writer().screen().contents()
  }

  fn parser(&self) -> &vt100::Parser {
    self.inner.writer()
  }
}

impl Write for Vt100Backend {
  fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
    self.inner.writer_mut().write(buf)
  }

  fn flush(&mut self) -> io::Result<()> {
    self.inner.writer_mut().flush()
  }
}

impl fmt::Display for Vt100Backend {
  fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
    write!(f, "{}", self.parser().screen().contents())
  }
}

impl Backend for Vt100Backend {
  fn draw<'a, I>(&mut self, content: I) -> io::Result<()>
  where
    I: Iterator<Item = (u16, u16, &'a Cell)>,
  {
    self.inner.draw(content)?;
    Ok(())
  }

  fn hide_cursor(&mut self) -> io::Result<()> {
    self.inner.hide_cursor()?;
    Ok(())
  }

  fn show_cursor(&mut self) -> io::Result<()> {
    self.inner.show_cursor()?;
    Ok(())
  }

  fn get_cursor_position(&mut self) -> io::Result<Position> {
    Ok(self.parser().screen().cursor_position().into())
  }

  fn set_cursor_position<P: Into<Position>>(&mut self, position: P) -> io::Result<()> {
    self.inner.set_cursor_position(position)
  }

  fn clear(&mut self) -> io::Result<()> {
    self.inner.clear()
  }

  fn clear_region(&mut self, clear_type: ClearType) -> io::Result<()> {
    self.inner.clear_region(clear_type)
  }

  fn append_lines(&mut self, line_count: u16) -> io::Result<()> {
    self.inner.append_lines(line_count)
  }

  fn size(&self) -> io::Result<Size> {
    let (rows, cols) = self.parser().screen().size();
    Ok(Size::new(cols, rows))
  }

  fn window_size(&mut self) -> io::Result<WindowSize> {
    Ok(WindowSize {
      columns_rows: self.parser().screen().size().into(),
      pixels: Size {
        width: 640,
        height: 480,
      },
    })
  }

  fn flush(&mut self) -> io::Result<()> {
    self.inner.writer_mut().flush()
  }

  fn scroll_region_up(&mut self, region: std::ops::Range<u16>, scroll_by: u16) -> io::Result<()> {
    self.inner.scroll_region_up(region, scroll_by)
  }

  fn scroll_region_down(&mut self, region: std::ops::Range<u16>, scroll_by: u16) -> io::Result<()> {
    self.inner.scroll_region_down(region, scroll_by)
  }
}

// (Enum parsing helpers live in parsing.rs.)
