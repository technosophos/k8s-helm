package tiller

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strings"

	"github.com/deis/quokka/pkg/javascript"
	"github.com/deis/quokka/pkg/javascript/libk8s"
	"github.com/ghodss/yaml"

	"k8s.io/helm/pkg/chartutil"
	"k8s.io/helm/pkg/proto/hapi/release"
	"k8s.io/helm/pkg/proto/hapi/services"
	"k8s.io/helm/pkg/timeconv"
)

func hasJSInstall(r *release.Release) bool {
	_, err := getfile(r, "install.js")
	return err == nil
}

func jsInstall(r *release.Release, req *services.InstallReleaseRequest) error {
	log.Print("Executing javascript instead of performing native install")
	script, err := getfile(r, "install.js")
	if err != nil {
		return err
	}
	rt := javascript.NewRuntime()
	libk8s.Register(rt.VM)

	// Pass the VM some useful info

	// Transform the release into a JS object.
	rel := map[string]interface{}{}
	if err := remarshal(r, &rel); err != nil {
		return err
	}
	rt.VM.Set("release", rel)

	// Parse the manifest into objects
	rt.VM.Set("resources", jsManifests(r.Manifest))

	// Recreate the .Values data
	ts := timeconv.Now()
	options := chartutil.ReleaseOptions{
		Name:      r.Name,
		Time:      ts,
		Namespace: req.Namespace,
		Revision:  int(r.Version),
		IsInstall: true,
	}
	valuesToRender, err := chartutil.ToRenderValues(req.Chart, req.Values, options)
	if err != nil {
		return err
	}
	rt.VM.Set("tpl", valuesToRender)

	_, err = rt.VM.Run(script)
	return err
}

func getfile(r *release.Release, name string) (string, error) {
	files := chartutil.NewFiles(r.Chart.Files)
	for f, content := range files {
		log.Printf("Scanning %q for %q", f, name)
		if f == name {
			log.Printf("Found %q", name)
			return string(content), nil
		}
	}
	return "", errors.New("file not found in chart")
}

func jsManifests(content string) []map[string]interface{} {
	manifests := strings.Split(content, "\n---\n")
	resources := []map[string]interface{}{}
	for _, f := range manifests {
		if strings.TrimSpace(f) == "" {
			log.Printf("Skipping empty resource")
			continue
		}
		m := map[string]interface{}{}
		if err := yaml.Unmarshal([]byte(f), &m); err != nil {
			log.Printf("Error parsing yaml: %s", err)
			continue
		}
		resources = append(resources, m)
	}
	return resources
}

func remarshal(src, dest interface{}) error {
	data, err := json.Marshal(src)
	if err != nil {
		return fmt.Errorf("remarshal %T=>%T (1): %s", src, dest, err)
	}
	if err = json.Unmarshal(data, dest); err != nil {
		return fmt.Errorf("remarshal %T=>%T (2): %s", src, dest, err)
	}
	return nil
}
