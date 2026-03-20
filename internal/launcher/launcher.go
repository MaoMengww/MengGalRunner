package launcher

import (
	"os"
	"os/exec"
	"time"

	"MengGalRunner/internal/model"
)

func Launch(game model.Game, onFinish func(duration int64)) error {
	if game.ExePath == "" {
		return os.ErrNotExist
	}
	if _, err := os.Stat(game.ExePath); err != nil {
		return err
	}

	cmd := exec.Command(game.ExePath)
	cmd.Dir = game.DirPath
	startAt := time.Now()

	if err := cmd.Start(); err != nil {
		return err
	}

	go func() {
		_ = cmd.Wait()
		duration := int64(time.Since(startAt).Seconds())
		if duration > 0 {
			onFinish(duration)
		}
	}()

	return nil
}
